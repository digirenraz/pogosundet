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
// Fetches raids from the last 2 hours, then filters client-side:
// a raid is "active" if COALESCE(starts_at, created_at) is within the last 45 minutes.
// Client-side filter avoids complex PostgREST timestamp syntax.
export async function getActiveRaids() {
  const supabase = await createClient();

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('raids')
    .select('*, raid_attendees(user_id, profiles(trainer_name))')
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };

  const threshold = new Date(Date.now() - 45 * 60 * 1000);
  const active = (data ?? []).filter(raid => {
    const ref = raid.starts_at ?? raid.created_at;
    return new Date(ref) > threshold;
  });

  return { data: active as RaidWithAttendees[], error: null };
}
