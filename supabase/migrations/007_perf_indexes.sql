-- Performance indexes for hot-path queries.
-- Run in the Supabase SQL editor.
--
-- raids.created_at is used in WHERE/ORDER BY by getActiveRaids / getRecentRaids
-- on every visit to /raids. raid_messages(raid_id, created_at) is used to load
-- the chat in the raid detail page. profiles.team backs the directory filter chips.

create index if not exists raids_created_at_idx
  on public.raids (created_at desc);

create index if not exists raid_messages_raid_created_idx
  on public.raid_messages (raid_id, created_at);

create index if not exists profiles_team_idx
  on public.profiles (team)
  where team is not null;
