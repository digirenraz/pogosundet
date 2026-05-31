-- Slice: raid completion + raid-level reactions. Run in the Supabase SQL editor.

-- 1. Completion flag. NULL = not completed; a timestamp = marked completed by
-- the poster. A completed raid is treated as "ended" client-side (drops into the
-- greyed section) regardless of its age.
ALTER TABLE public.raids ADD COLUMN completed_at timestamptz;

-- raids previously had no UPDATE policy at all. Allow only the poster to update
-- their own raid (this is what gates toggleRaidCompleted). Both USING and
-- WITH CHECK pin the row to the owner so they can't reassign it either.
CREATE POLICY "Users update own raids"
  ON public.raids FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Reactions to the raid itself (not a chat message). Stable codes live in the
-- DB; human labels live in i18n. PK enforces "one of each reaction per user per
-- raid" — a toggle is either an INSERT (add) or DELETE (remove), no UPDATE path.
-- The PK's leading raid_id also indexes the per-raid count reads.
CREATE TABLE public.raid_reactions (
  raid_id    uuid NOT NULL REFERENCES public.raids(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction   text NOT NULL CHECK (reaction IN ('tfr', 'shiny', 'hundo')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (raid_id, user_id, reaction)
);

ALTER TABLE public.raid_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read raid reactions"
  ON public.raid_reactions FOR SELECT USING (true);

CREATE POLICY "Users add own raid reactions"
  ON public.raid_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own raid reactions"
  ON public.raid_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable real-time replication so reaction toggles propagate to all clients.
ALTER PUBLICATION supabase_realtime ADD TABLE public.raid_reactions;
