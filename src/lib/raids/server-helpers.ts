import { createClient } from '@/lib/supabase/server';

export interface AttendeeProfile {
  trainer_name: string;
}

export interface RaidAttendeeWithProfile {
  user_id: string;
  profiles: AttendeeProfile | null;
}

export interface RaidWithAttendees {
  id: string;
  user_id: string;
  image_url: string | null;
  gym_name: string | null;
  boss_name: string | null;
  starts_at: string | null;
  note: string | null;
  created_at: string;
  raid_attendees: RaidAttendeeWithProfile[];
}

// Fetches active raids with their attendees.
// A raid is "active" if COALESCE(starts_at, created_at) is within the last 45 minutes.
export async function getActiveRaids() {
  const supabase = await createClient();

  const threshold = new Date(Date.now() - 45 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('raids')
    .select('*, raid_attendees(user_id, profiles(trainer_name))')
    .or(`starts_at.gt.${threshold},and(starts_at.is.null,created_at.gt.${threshold})`)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };
  return { data: (data ?? []) as RaidWithAttendees[], error: null };
}
