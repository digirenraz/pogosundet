-- Block joining a raid once it has been marked completed.
-- The UI already hides the RSVP button on completed raids (RaidDetail), but
-- joinRaid() writes to raid_attendees directly via RLS, so a client that had
-- the raid open *before* it was completed could still insert. This tightens
-- the INSERT policy to also require the target raid is not completed.
--
-- Leaving a completed raid (DELETE) stays allowed — only new participation
-- is blocked.

drop policy if exists "Users can join raids" on public.raid_attendees;

create policy "Users can join raids"
  on public.raid_attendees for insert with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.raids r
      where r.id = raid_id
        and r.completed_at is not null
    )
  );
