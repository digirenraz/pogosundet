-- Migration 027: per-user record of whether the app is installed to the home
-- screen and whether notifications are allowed.
--
-- WHY: push only reaches people who (a) installed the PWA — mandatory on iOS —
-- and (b) granted notification permission. Until now nothing recorded either,
-- so there was no way to tell whether the community was actually set up to
-- receive raid alerts, or who to nudge. `push_subscriptions` is close to a
-- signal for (b), but it survives a PWA uninstall (see PushSubscribePrompt),
-- and it says nothing at all about (a).
--
-- The row is written by the client on app open, through record_app_setup()
-- below — never by a direct insert — so the merge logic (installed_at is
-- first-seen and never cleared) lives in one place.
--
-- PRIVACY: this is technical device state about a member, readable only by the
-- member themselves (RLS below) and by the service role on the admin screen.
-- It is not exposed to other members anywhere in the app. Privacy Policy §2/§3
-- updated in the same change.
--
-- Numbered 027, not 026: PR #238 (live location sharing) claimed 026 first
-- while this branch was open — same renumber the moderation migration did when
-- the event-bot migration took 023. Ordering between the two is independent;
-- neither touches the other's tables.
--
-- Apply-before-merge ordering (like 021/023/024): the /admin setup tab reads
-- this table and every app open calls the RPC, so it must exist in prod before
-- the PR merges. Apply to `pogosundet-preview` too.

CREATE TABLE public.app_setup_status (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- First time we ever saw this user running the app in standalone (installed)
  -- mode. Never cleared: an uninstall is inferred from last_standalone_at
  -- going stale, not from this going null.
  installed_at       timestamptz,
  -- Most recent standalone open. Together with last_seen_at this distinguishes
  -- "installed and using it" from "installed once, now only opens in a browser".
  last_standalone_at timestamptz,
  -- Most recent report of any kind. Members with no row at all simply haven't
  -- opened the app since this shipped — that's "unknown", not "not installed".
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  -- The browser's Notification.permission on that device, or 'unsupported'
  -- where the Push API isn't available (e.g. iOS Safari outside a home-screen
  -- install). 'denied' is the interesting one: nudging won't help, the user has
  -- to undo it in system settings.
  push_permission    text NOT NULL DEFAULT 'default'
                     CHECK (push_permission IN ('default', 'granted', 'denied', 'unsupported')),
  platform           text NOT NULL DEFAULT 'other'
                     CHECK (platform IN ('ios', 'android', 'desktop', 'other'))
);

ALTER TABLE public.app_setup_status ENABLE ROW LEVEL SECURITY;

-- Owner-only. There is deliberately no admin SELECT policy: the admin screen
-- reads through the service role instead (same approach getReports() uses for
-- profiles.banned_at), so no ordinary authenticated role can ever read another
-- member's device state, even with a forged request.
CREATE POLICY "Users read own setup status" ON public.app_setup_status
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own setup status" ON public.app_setup_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own setup status" ON public.app_setup_status
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Records one app open. SECURITY INVOKER: the policies above are still what
-- authorises the write, and auth.uid() fixes the row — a caller cannot report
-- on behalf of anyone else.
--
-- The merge rules are the whole reason this is a function rather than a
-- PostgREST upsert: installed_at must survive a later non-standalone open
-- (opening the site in a browser tab does not mean you uninstalled the app),
-- and so must last_standalone_at.
CREATE OR REPLACE FUNCTION public.record_app_setup(
  p_standalone       boolean,
  p_push_permission  text,
  p_platform         text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_permission text;
  v_platform   text;
  v_standalone timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Clamp rather than trust: an unexpected value from a future browser should
  -- degrade to 'default'/'other', not raise a CHECK violation on app open.
  v_permission := CASE
    WHEN p_push_permission IN ('default', 'granted', 'denied', 'unsupported')
      THEN p_push_permission
    ELSE 'default'
  END;
  v_platform := CASE
    WHEN p_platform IN ('ios', 'android', 'desktop', 'other') THEN p_platform
    ELSE 'other'
  END;
  v_standalone := CASE WHEN p_standalone THEN now() END;

  INSERT INTO public.app_setup_status AS s (
    user_id, installed_at, last_standalone_at, last_seen_at,
    push_permission, platform
  )
  VALUES (
    auth.uid(), v_standalone, v_standalone, now(),
    v_permission, v_platform
  )
  ON CONFLICT (user_id) DO UPDATE SET
    installed_at       = COALESCE(s.installed_at, EXCLUDED.installed_at),
    last_standalone_at = COALESCE(EXCLUDED.last_standalone_at, s.last_standalone_at),
    last_seen_at       = EXCLUDED.last_seen_at,
    push_permission    = EXCLUDED.push_permission,
    platform           = EXCLUDED.platform;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_app_setup(boolean, text, text) TO authenticated;

-- No realtime publication: this is written once per app open and read only by
-- the admin screen.
