-- Slice 17: 1:1 direct messages between two profiles.
-- Adds `direct_messages` (with threaded reply_to_id), `direct_message_reactions`,
-- and `dm_reads` (per-pair last-read timestamp for the unread badge).
-- Run in Supabase SQL editor after 013_raid_chat_reactions_and_replies.sql.

-- Direct messages between two profiles.
CREATE TABLE public.direct_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(trim(body)) > 0),
  reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

-- Pair-key index: every conversation lookup boils down to "all messages between
-- two specific users, newest first". `least`/`greatest` ensures both directions
-- of the pair share an index entry.
CREATE INDEX direct_messages_pair_idx
  ON public.direct_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at DESC);

CREATE INDEX direct_messages_reply_to_idx
  ON public.direct_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read own DMs" ON public.direct_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send DMs as themselves" ON public.direct_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- FK to profiles so embedded selects (sender:profiles(trainer_name,...)) work.
-- profiles.user_id is unique; same pattern as raid_attendees and channel_messages.
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_sender_profile_fk
  FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id);
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_recipient_profile_fk
  FOREIGN KEY (recipient_id) REFERENCES public.profiles(user_id);

-- Reactions — same shape as channel/raid reactions but locked down to
-- conversation participants only via an EXISTS subquery on direct_messages.
CREATE TABLE public.direct_message_reactions (
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;

-- Only conversation participants can read reactions on a DM.
CREATE POLICY "Participants can read DM reactions" ON public.direct_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages m
      WHERE m.id = message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.recipient_id)
    )
  );

-- Only participants can add reactions, and only as themselves.
CREATE POLICY "Participants can add DM reactions" ON public.direct_message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.direct_messages m
      WHERE m.id = message_id
        AND (auth.uid() = m.sender_id OR auth.uid() = m.recipient_id)
    )
  );

CREATE POLICY "Users remove own DM reactions" ON public.direct_message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Read tracking — one row per (viewer, partner) pair. Mirrors channel_reads.
CREATE TABLE public.dm_reads (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_id),
  CHECK (user_id <> partner_id)
);

ALTER TABLE public.dm_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dm_reads" ON public.dm_reads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own dm_reads" ON public.dm_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own dm_reads" ON public.dm_reads
  FOR UPDATE USING (auth.uid() = user_id);

-- Realtime publication so message + reaction inserts surface to subscribed clients.
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_message_reactions;
