-- Migration 026: live location sharing ("Hvem spiller nu").
--
-- Run in the Supabase SQL editor after 025_fix_account_deletion_cascade.sql.
--
-- APPLY BEFORE MERGE. The /kort screen calls get_live_locations() and the share
-- button calls start_location_share() on first load after the code deploys, so
-- this migration must be applied to the PROD project before the PR merges (and
-- to pogosundet-preview so Preview builds work).
--
-- AFTER APPLYING, schedule the purge job (see section 5). It needs the pg_cron
-- extension, which is enabled per-project in the Supabase dashboard under
-- Database -> Extensions. The feature still works without it — get_live_locations()
-- purges on read — but the "deleted within a minute" promise depends on the job.
--
-- WHY THIS SHAPE. The product promise is that we do not keep location data.
-- Four mechanisms enforce it, deliberately layered so no single failure breaks
-- the promise:
--
--   1. user_id is the PRIMARY KEY. A share upserts over your previous position,
--      so location *history* is impossible by construction — there is no table
--      it could accumulate in. This is the strongest of the four, because it is
--      structural rather than procedural.
--   2. RLS hides expired rows (expires_at > now()), so a row past its window is
--      already invisible to every client before anything deletes it.
--   3. pg_cron deletes expired rows every minute (section 5).
--   4. get_live_locations() purges before selecting, as a backstop for when
--      pg_cron is unavailable or disabled.
--
-- There is deliberately no soft-delete column, no audit table, and no history
-- of any kind. Positions are hard-deleted.
--
-- We also store no GPS accuracy figure: nothing in the UI shows it, and a field
-- nobody reads is personal data kept for no purpose (data minimisation).

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

CREATE TABLE public.live_locations (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  -- Optional free-text hint ("ved havnen"). Length capped like every other
  -- user-supplied string in this schema (see 019_input_length_limits).
  note       text CHECK (char_length(note) <= 80),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT live_locations_window_chk CHECK (expires_at > updated_at)
);

-- Second FK so PostgREST can embed profiles(trainer_name, avatar_url, ...).
-- ON DELETE CASCADE is explicit and load-bearing: this is exactly the class of
-- bug that migration 025 fixed. Without it, deleting an account races two
-- independent cascade paths off the same auth.users row and can fail outright.
ALTER TABLE public.live_locations
  ADD CONSTRAINT live_locations_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Drives both the RLS predicate and the purge delete.
CREATE INDEX live_locations_expires_at_idx ON public.live_locations (expires_at);

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

-- Active shares are visible to every logged-in member, same as the player
-- directory. Expired rows are invisible even while they still physically exist.
CREATE POLICY "Members read active shares"
  ON public.live_locations FOR SELECT
  USING (expires_at > now());

-- Stopping a share must always work, even if the RPCs are broken — so this is a
-- plain policy rather than another function.
CREATE POLICY "Users stop own share"
  ON public.live_locations FOR DELETE
  USING (auth.uid() = user_id);

-- NOTE: there is deliberately NO INSERT or UPDATE policy. Writes go only through
-- start_location_share() below, whose SECURITY DEFINER context is the only write
-- path. That is what makes the 2-hour cap and the coordinate rounding real
-- guarantees rather than client-side conventions a hand-rolled PostgREST call
-- could ignore. Same reasoning as message_reports in migration 024.

-- ---------------------------------------------------------------------------
-- 3. Purge
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_expired_locations()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.live_locations WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------

-- The only write path. Clamps the duration and rounds the coordinates in the
-- database, so neither depends on the client behaving.
CREATE OR REPLACE FUNCTION public.start_location_share(
  p_lat     double precision,
  p_lng     double precision,
  p_minutes integer,
  p_note    text DEFAULT NULL
)
  RETURNS timestamptz
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_minutes integer;
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF public.is_banned() THEN
    RAISE EXCEPTION 'banned';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'invalid_position';
  END IF;

  -- Hard 2-hour ceiling. The UI offers 15/30/60/120, but the cap lives here so
  -- a bug (or a direct RPC call) cannot open an eight-hour window.
  v_minutes := LEAST(GREATEST(COALESCE(p_minutes, 30), 1), 120);
  v_expires := now() + make_interval(mins => v_minutes);

  -- 5 decimals is ~1 m — all the precision this feature can use, and it drops
  -- the meaningless tail digits GPS reports.
  INSERT INTO public.live_locations AS l (
    user_id, lat, lng, note, updated_at, expires_at
  )
  VALUES (
    v_user,
    round(p_lat::numeric, 5)::double precision,
    round(p_lng::numeric, 5)::double precision,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    now(),
    v_expires
  )
  ON CONFLICT (user_id) DO UPDATE
    SET lat        = EXCLUDED.lat,
        lng        = EXCLUDED.lng,
        note       = COALESCE(EXCLUDED.note, l.note),
        updated_at = EXCLUDED.updated_at,
        expires_at = EXCLUDED.expires_at;

  RETURN v_expires;
END;
$$;

-- Refresh position only, keeping the existing expiry. This is what the
-- refresh-on-focus path calls: bringing the app to the foreground should move
-- your pin, never silently extend how long you are sharing for.
CREATE OR REPLACE FUNCTION public.refresh_location_share(
  p_lat double precision,
  p_lng double precision
)
  RETURNS timestamptz
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'invalid_position';
  END IF;

  UPDATE public.live_locations
     SET lat        = round(p_lat::numeric, 5)::double precision,
         lng        = round(p_lng::numeric, 5)::double precision,
         updated_at = now()
   WHERE user_id = v_user
     AND expires_at > now()
  RETURNING expires_at INTO v_expires;

  -- No active share (expired between the client deciding to refresh and the
  -- write landing) — a no-op, not an error. The client clears its own state.
  RETURN v_expires;
END;
$$;

-- Read path. Purges first so an expired row cannot outlive the moment someone
-- looks, then returns active shares joined to their profile.
CREATE OR REPLACE FUNCTION public.get_live_locations()
  RETURNS TABLE (
    user_id      uuid,
    lat          double precision,
    lng          double precision,
    note         text,
    updated_at   timestamptz,
    expires_at   timestamptz,
    trainer_name text,
    avatar_url   text,
    team         text,
    level        smallint
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Guarded so the common case (nothing expired) stays read-only.
  IF EXISTS (SELECT 1 FROM public.live_locations l WHERE l.expires_at < now()) THEN
    PERFORM public.purge_expired_locations();
  END IF;

  RETURN QUERY
    SELECT l.user_id, l.lat, l.lng, l.note, l.updated_at, l.expires_at,
           p.trainer_name, p.avatar_url, p.team, p.level
      FROM public.live_locations l
      JOIN public.profiles p ON p.user_id = l.user_id
     WHERE l.expires_at > now()
       AND p.is_bot = false
     ORDER BY l.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_location_share(double precision, double precision, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_location_share(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_locations() TO authenticated;

-- purge_expired_locations() is intentionally NOT granted to authenticated — it
-- runs from pg_cron and from inside get_live_locations(), both of which execute
-- as the definer. No client needs to call it directly.

-- ---------------------------------------------------------------------------
-- 5. Scheduled purge (run separately, after enabling pg_cron)
-- ---------------------------------------------------------------------------
--
-- Dashboard -> Database -> Extensions -> enable "pg_cron", then run:
--
--   SELECT cron.schedule(
--     'purge-live-locations',
--     '* * * * *',
--     $job$ SELECT public.purge_expired_locations() $job$
--   );
--
-- To verify: insert a row with expires_at in the past and confirm it disappears
-- within a minute. To remove: SELECT cron.unschedule('purge-live-locations');

-- ---------------------------------------------------------------------------
-- 6. Realtime
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_locations;
