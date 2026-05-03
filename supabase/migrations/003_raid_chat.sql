-- Slice 8 prep: per-raid chat messages + extra-player count on attendees.
-- Run in Supabase SQL editor after 002_create_raids.sql.

-- Extra players a user is bringing to a raid
ALTER TABLE public.raid_attendees
  ADD COLUMN extra_count int NOT NULL DEFAULT 0;

-- Chat messages per raid
CREATE TABLE public.raid_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raid_id    uuid NOT NULL REFERENCES public.raids(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message    text NOT NULL CHECK (length(trim(message)) > 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.raid_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read raid messages"
  ON public.raid_messages FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send messages"
  ON public.raid_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- FK to profiles so Supabase can embed profiles(trainer_name) in message queries.
ALTER TABLE public.raid_messages
  ADD CONSTRAINT raid_messages_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

-- Enable real-time replication so clients receive new messages without polling.
-- Requires Replication to be enabled for this table in Supabase dashboard.
ALTER PUBLICATION supabase_realtime ADD TABLE public.raid_messages;
