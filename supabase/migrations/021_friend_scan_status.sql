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
