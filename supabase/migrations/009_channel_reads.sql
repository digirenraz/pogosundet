-- Slice 12: per-user "last read" timestamps for the chat channels.
-- Drives the unread badges on the BottomNav and on the channel-list rows.
-- Run in Supabase SQL editor after 008_channel_messages.sql.

CREATE TABLE public.channel_reads (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel      text NOT NULL CHECK (channel IN ('generelt', 'feedback')),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel)
);

ALTER TABLE public.channel_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own reads"
  ON public.channel_reads FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own reads"
  ON public.channel_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own reads"
  ON public.channel_reads FOR UPDATE USING (auth.uid() = user_id);

-- No realtime publication — clients listen to channel_messages INSERTs and
-- maintain unread counts locally. Account deletion cascades via user_id FK.
