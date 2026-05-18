-- Slice 11: community chat channels (#generelt, #app-feedback).
-- Run in Supabase SQL editor after 007_perf_indexes.sql.

-- Free-text community messages keyed by a hard-coded channel slug.
-- No DELETE policy by design (matches raid_messages) — users cannot delete
-- their own messages in Phase 1. Account deletion cascades via the
-- auth.users ON DELETE CASCADE on user_id. Messages are kept indefinitely.
CREATE TABLE public.channel_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel    text NOT NULL CHECK (channel IN ('generelt', 'feedback')),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read channel messages"
  ON public.channel_messages FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send messages"
  ON public.channel_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- FK to profiles so Supabase can embed profiles(trainer_name, …) in queries.
ALTER TABLE public.channel_messages
  ADD CONSTRAINT channel_messages_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

-- Hot path: list latest N messages for a channel.
CREATE INDEX channel_messages_channel_created_idx
  ON public.channel_messages (channel, created_at DESC);

-- Enable real-time replication so clients receive new messages without polling.
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;
