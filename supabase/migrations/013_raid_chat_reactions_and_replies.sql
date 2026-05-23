-- Slice 16: raid chat replies + emoji reactions.
-- Mirror of 010 but on raid_messages. Run in the Supabase SQL editor after 012.

-- Threaded replies on raid chat messages. ON DELETE SET NULL means
-- deleting a referenced message (e.g. via account cascade) leaves the reply
-- intact but unthreaded.
ALTER TABLE public.raid_messages
  ADD COLUMN reply_to_id uuid REFERENCES public.raid_messages(id) ON DELETE SET NULL;

CREATE INDEX raid_messages_reply_to_idx
  ON public.raid_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Emoji reactions. PK enforces "one of each emoji per user per message" — a
-- toggle is either an INSERT (add) or DELETE (remove), no UPDATE path.
CREATE TABLE public.raid_message_reactions (
  message_id uuid NOT NULL REFERENCES public.raid_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.raid_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read raid reactions"
  ON public.raid_message_reactions FOR SELECT USING (true);

CREATE POLICY "Users add own raid reactions"
  ON public.raid_message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own raid reactions"
  ON public.raid_message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable real-time replication so reaction toggles propagate to all clients.
ALTER PUBLICATION supabase_realtime ADD TABLE public.raid_message_reactions;
