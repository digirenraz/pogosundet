-- Enable Supabase Realtime broadcasts on raid-related tables so the app can
-- subscribe to changes via the JS client (used by useRaidsRealtime hook).
-- Apply manually in the Supabase SQL editor.
alter publication supabase_realtime add table public.raids;
alter publication supabase_realtime add table public.raid_attendees;
alter publication supabase_realtime add table public.raid_messages;
