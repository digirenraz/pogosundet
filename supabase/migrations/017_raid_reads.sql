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
