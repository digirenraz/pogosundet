-- Track when each player was last online. Written by use-presence.ts on every
-- authenticated page load that subscribes to the presence channel (fire-and-
-- forget, best-effort). Nullable so existing rows are unaffected and new users
-- simply show no badge until their first session. The existing RLS UPDATE
-- policy on profiles covers this column automatically.
ALTER TABLE public.profiles
  ADD COLUMN last_seen_at timestamptz;
